const MODEL = "gpt-4o-mini";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OpenAI is not configured. Add OPENAI_API_KEY in Vercel environment variables." });
    return;
  }

  const routine = typeof req.body?.routine === "string" ? req.body.routine.trim() : "";
  const baseDate = typeof req.body?.baseDate === "string" ? req.body.baseDate : new Date().toISOString().slice(0, 10);
  if (!routine || routine.length > 12000) {
    res.status(400).json({ error: "Send a routine between 1 and 12,000 characters." });
    return;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "taskloom_routine",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    date: { type: "string", description: "YYYY-MM-DD" },
                    time: { type: "string", description: "24-hour HH:MM" },
                  },
                  required: ["title", "date", "time"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `You convert a person's full-day routine into actionable tasks for Taskloom. The base date is ${baseDate}. Resolve relative dates like today, tomorrow, Monday, and next week from that base date. Return only meaningful actionable tasks, never headings or general commentary. Preserve the user's wording when useful. Every task must have a valid YYYY-MM-DD date and a 24-hour HH:MM time. If a task has no explicit time, choose a sensible time based on its order in the day (use 09:00, 12:00, 15:00, or 18:00). Keep task titles concise.`,
        },
        { role: "user", content: routine },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    res.status(response.status >= 500 ? 502 : response.status).json({ error: payload?.error?.message || "OpenAI could not parse that routine." });
    return;
  }

  try {
    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((task) => task && typeof task.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.date) && /^\d{2}:\d{2}$/.test(task.time))
          .slice(0, 50)
          .map((task) => ({ title: task.title.trim().slice(0, 180), date: task.date, time: task.time }))
          .filter((task) => task.title.length > 0)
      : [];
    res.status(200).json({ tasks });
  } catch {
    res.status(502).json({ error: "The routine response was not valid task data. Please try again." });
  }
}
