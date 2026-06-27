import { Flow, FlowAction, FlowContext } from './types';

const MENU_TRIGGERS = new Set(['hi', 'hello', 'hey', 'menu', 'start', 'help', '/start', '/menu']);

export class FlowEngine {
  private flows = new Map<string, Flow>();

  register(flow: Flow): void {
    this.flows.set(flow.id, flow);
  }

  async process(
    message: string,
    ctx: FlowContext
  ): Promise<{ actions: FlowAction[]; newCtx: FlowContext }> {
    const lower = message.toLowerCase().trim();

    if (!ctx.currentFlow || MENU_TRIGGERS.has(lower)) {
      return this.startFlow('main-menu', ctx);
    }

    const flow = this.flows.get(ctx.currentFlow);
    if (!flow) {
      return this.startFlow('main-menu', ctx);
    }

    const step = ctx.currentStep ? flow.steps.get(ctx.currentStep) : undefined;
    if (!step) {
      return this.startFlow('main-menu', ctx);
    }

    const rawActions = await step(message, ctx);
    return this.applyActions(rawActions, ctx);
  }

  async startFlow(
    flowId: string,
    ctx: FlowContext
  ): Promise<{ actions: FlowAction[]; newCtx: FlowContext }> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      return {
        actions: [{ type: 'send_text', text: 'Something went wrong. Please try again.' }],
        newCtx: ctx,
      };
    }

    if (!flow.onEntry) {
      return { actions: [], newCtx: { ...ctx, currentFlow: flowId, currentStep: null } };
    }

    const rawActions = await flow.onEntry(ctx);
    return this.applyActions(rawActions, ctx);
  }

  private async applyActions(
    rawActions: FlowAction[],
    ctx: FlowContext
  ): Promise<{ actions: FlowAction[]; newCtx: FlowContext }> {
    let newCtx: FlowContext = { ...ctx };
    const outputActions: FlowAction[] = [];

    for (const action of rawActions) {
      if (action.type === 'update_context') {
        newCtx = { ...newCtx, ...action.updates };
      } else if (action.type === 'transition') {
        const result = await this.startFlow(action.flow, { ...newCtx, currentFlow: action.flow, currentStep: action.step });
        newCtx = result.newCtx;
        outputActions.push(...result.actions);
      } else if (action.type === 'end_flow') {
        newCtx = { ...newCtx, currentFlow: null, currentStep: null };
      } else {
        outputActions.push(action);
      }
    }

    return { actions: outputActions, newCtx };
  }
}
