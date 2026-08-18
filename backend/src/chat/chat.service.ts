import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ContextBuilderService } from './context-builder.service';

export interface ChatTarget {
  ideaId?: string;
  surveyId?: string;
}

const SYSTEM_PROMPT = `You are the AI Validation Assistant inside IdeaValidator — a senior startup advisor, product strategist, venture analyst, and customer researcher rolled into one. You are embedded in a specific founder's validation report, and the full report data is provided to you below as REPORT CONTEXT. You already know everything in it — never ask the founder to describe their idea, problem, solution, audience, or survey; you already have that context.

Speak like an experienced, direct advisor — not a generic assistant. Be specific and concrete. Ground every claim strictly in the REPORT CONTEXT below. Never invent statistics, quotes, respondent counts, or expert opinions that are not present in it. If the evidence needed to answer is thin or missing, say so plainly instead of guessing.

For substantive questions (not simple factual lookups), structure your answer with these markdown sections — omit a section only when it genuinely doesn't apply:

**Summary**
A short, direct answer in 1-3 sentences.

**Evidence**
Cite the actual numbers, percentages, sample sizes, or quotes from the REPORT CONTEXT (e.g. "68% of respondents...", "Only 14 respondents answered this question...", "One expert reviewer noted...").

**Recommendation**
Concrete, specific next actions — not generic startup advice a founder could get without this data.

**Confidence:** High / Medium / Low — based on the sample size and strength of the evidence. Small samples (fewer than 10 survey responses, or fewer than 3 expert reviews) should never be called High confidence.

CHALLENGE MODE: when asked to challenge the idea, find flaws, play devil's advocate, or point out what's being overlooked, actively look for: weak or untested assumptions, confirmation bias in how the founder framed things, poor survey design, small sample sizes, weak or contradictory evidence, low willingness to pay, missing real customer validation, and market risks. Be respectfully but genuinely critical — do not default to agreement or encouragement for its own sake.

Use markdown formatting (bold, bullet lists, numbered lists, tables where useful) for readability.`;

// Groq streaming failures used to escape as a bare disconnect with nothing
// useful in devtools — this always emits one readable SSE error frame first,
// mirroring AiService.toAiError's diagnosis but for the streaming path.
function describeGroqError(err: any): string {
  const status = err?.status ?? err?.response?.status;
  if (status === 401 || status === 403) return 'AI service rejected the API key — check GROQ_API_KEY on the server.';
  if (status === 429) return 'AI service is rate limited right now — try again in a minute.';
  if (status === 400 && /model|decommission/i.test(err?.message || '')) return 'The configured AI model is no longer available.';
  return 'AI service is temporarily unavailable — try again shortly.';
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private contextBuilder: ContextBuilderService,
  ) {}

  private targetWhere(founderId: string, target: ChatTarget) {
    if (target.ideaId) return { founderId, ideaId: target.ideaId, surveyId: null as any };
    if (target.surveyId) return { founderId, ideaId: null as any, surveyId: target.surveyId };
    throw new BadRequestException('A report target is required.');
  }

  private async findConversation(founderId: string, target: ChatTarget) {
    return this.prisma.aiConversation.findFirst({ where: this.targetWhere(founderId, target) });
  }

  private async getOrCreateConversation(founderId: string, target: ChatTarget) {
    const existing = await this.findConversation(founderId, target);
    if (existing) return existing;
    return this.prisma.aiConversation.create({
      data: { founderId, ideaId: target.ideaId ?? null, surveyId: target.surveyId ?? null },
    });
  }

  // ---------- read ----------

  // Ownership is verified by the caller (controller) building the context
  // once per request via ContextBuilderService, which throws on mismatch —
  // this method itself only ever reads rows already scoped to founderId.
  async getConversation(founderId: string, target: ChatTarget) {
    const conversation = await this.findConversation(founderId, target);
    if (!conversation) return { conversationId: null, messages: [] };
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return { conversationId: conversation.id, messages };
  }

  // ---------- write ----------

  async startNewChat(founderId: string, target: ChatTarget) {
    const conversation = await this.findConversation(founderId, target);
    if (conversation) await this.prisma.aiMessage.deleteMany({ where: { conversationId: conversation.id } });
    return { success: true };
  }

  async deleteConversation(founderId: string, target: ChatTarget) {
    const conversation = await this.findConversation(founderId, target);
    if (conversation) await this.prisma.aiConversation.delete({ where: { id: conversation.id } });
    return { success: true };
  }

  // ---------- streaming ----------

  private buildReportContext(target: ChatTarget, founderId: string): Promise<string> {
    return target.ideaId
      ? this.contextBuilder.buildIdeaContext(target.ideaId, founderId)
      : this.contextBuilder.buildSurveyContext(target.surveyId!, founderId);
  }

  private writeSse(res: Response, payload: any) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  // Shared by sendMessage (appends a new user message first) and regenerate
  // (re-answers the existing trailing user message) — both end up here with
  // an ordered message history that already ends on a USER turn.
  private async streamCompletion(res: Response, conversationId: string, reportContext: string, history: { role: string; content: string }[]) {
    const apiKey = process.env.GROQ_API_KEY;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx-style proxy buffering, if any sits in front
    res.flushHeaders?.();

    if (!apiKey) {
      this.writeSse(res, { type: 'error', message: 'AI service is not configured — GROQ_API_KEY is missing on the server.' });
      res.end();
      return;
    }

    // Bounded history: enough for a coherent conversation without unbounded
    // token growth on a long-running chat. Full history still lives in the DB
    // for display — this only limits what's sent to the model per call.
    const recent = history.slice(-20);
    const groq = new Groq({ apiKey });

    let aborted = false;
    res.on('close', () => { aborted = true; });

    let full = '';
    try {
      const stream = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: reportContext },
          ...recent.map((m) => ({ role: (m.role === 'ASSISTANT' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.content })),
        ],
        temperature: 0.5,
        max_tokens: 1600,
        reasoning_effort: 'low',
        stream: true,
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          this.writeSse(res, { type: 'delta', content: delta });
        }
      }
    } catch (err: any) {
      this.logger.error(`Groq streaming failed: ${err?.message}`);
      if (!aborted) this.writeSse(res, { type: 'error', message: describeGroqError(err) });
    }

    // Persist whatever was generated — including a client-initiated stop —
    // since a partial answer is still meaningful conversation history. Only
    // a true zero-output failure (e.g. auth error on the very first chunk)
    // skips the write.
    let savedId: string | null = null;
    if (full.trim()) {
      const saved = await this.prisma.aiMessage.create({
        data: { conversationId, role: 'ASSISTANT', content: full },
        select: { id: true },
      });
      savedId = saved.id;
    }

    if (!aborted) {
      this.writeSse(res, { type: 'done', messageId: savedId });
      res.end();
    }
  }

  async sendMessage(founderId: string, target: ChatTarget, content: string, res: Response) {
    const text = content.trim().slice(0, 4000);
    if (!text) throw new BadRequestException('Message cannot be empty.');

    // Builds context via the same ownership-checked service calls the report
    // pages use — throws ForbiddenException/NotFoundException before any
    // response headers are written if the founder doesn't own this report.
    const reportContext = await this.buildReportContext(target, founderId);

    const conversation = await this.getOrCreateConversation(founderId, target);
    await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'USER', content: text } });

    const history = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    await this.streamCompletion(res, conversation.id, reportContext, history);
  }

  async regenerate(founderId: string, target: ChatTarget, res: Response) {
    const reportContext = await this.buildReportContext(target, founderId);

    const conversation = await this.findConversation(founderId, target);
    if (!conversation) throw new BadRequestException('No conversation to regenerate.');

    let history = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true },
    });

    if (history.length && history[history.length - 1].role === 'ASSISTANT') {
      await this.prisma.aiMessage.delete({ where: { id: history[history.length - 1].id } });
      history = history.slice(0, -1);
    }
    if (!history.length || history[history.length - 1].role !== 'USER') {
      throw new BadRequestException('Nothing to regenerate yet — send a message first.');
    }

    await this.streamCompletion(res, conversation.id, reportContext, history);
  }
}
