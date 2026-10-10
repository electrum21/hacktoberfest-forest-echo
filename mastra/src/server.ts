import express from "express";
import { forestEchoWorkflow, inputSchema } from "./workflow.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "forest-echo-mastra" }));

app.post("/api/narrate", async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid observation", issues: parsed.error.issues });
  }
  try {
    const run = await forestEchoWorkflow.createRun();
    const result = await run.start({ inputData: parsed.data });
    if (result.status !== "success") {
      return res.status(502).json({ error: "workflow did not complete", status: result.status });
    }
    return res.json(result.result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "narration workflow failed" });
  }
});

const port = Number(process.env.PORT ?? 4112);
app.listen(port, () => console.log(`Forest Echo Mastra listening on :${port}`));
