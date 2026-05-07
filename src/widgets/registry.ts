export interface WidgetDecl {
  kind: "slider" | "select" | "toggle" | "number";
  name: string;
  min?: number;
  max?: number;
  step?: number;
  def: number | string | boolean;
  options?: string[];
}

export interface WidgetState {
  values: Map<string, number | string | boolean>;
}

export function createWidgetState(): WidgetState {
  return { values: new Map() };
}
