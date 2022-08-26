import { Configuration, OpenAIApi } from "openai";

declare var summaryengine_openapi_apikey: string;

const configuration = new Configuration({ apiKey: summaryengine_openapi_apikey});
const openai = new OpenAIApi(configuration);

function generateSummaryPrompt(body) {
    return `${body.replace(/(<([^>]+)>)/gi, "").slice(0,10000)}
    Summarize in 100 words:`;
}

export default async function summarise(content) {
    const prompt = generateSummaryPrompt(content);
    try {
        const completion = await openai.createCompletion({
            model: "text-davinci-002",
            prompt: prompt,
            temperature: 0.6,
            max_tokens: 300,
            top_p: 1,
            frequency_penalty: 0.5,
            presence_penalty: 0
        });
        return completion.data.choices[0].text.trim();
    } catch(err) {
        console.error(err.data ? JSON.stringify(err.data, null, 2) : err);
        console.log(prompt);
        return new Error(`Error summarising content`);
    }
}