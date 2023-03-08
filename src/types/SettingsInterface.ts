export interface ISettings {
    word_limit: number;
    cut_at_paragraph: boolean;
    prompt: string;
    append_prompt: string;
    openai_model: string;
    openai_max_tokens: number;
    openai_temperature: number;
    openai_top_p: number;
    openai_presence_penalty: number;
    openai_frequency_penalty: number;
}