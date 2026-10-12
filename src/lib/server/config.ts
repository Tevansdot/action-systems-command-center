import "server-only";
// The alternate name supports cloud secret binding rules that reserve OPENAI_*.
export function openAIKey() {
  return (
    process.env.ACTION_SYSTEMS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  );
}
export function generationProvider(): "openai" | "template" {
  return openAIKey() ? "openai" : "template";
}
