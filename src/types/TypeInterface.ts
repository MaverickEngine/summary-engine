export interface IType {
    ID: number;
    created_at?: Date;
    name: string;
    slug: string;
    openai_model: string;
    openai_word_limit: number;
    cut_at_paragraph: Boolean;
    openai_frequency_penalty: number;
    openai_max_tokens: number;
    openai_presence_penalty: number;
    openai_temperature: number;
    openai_top_p: number;
    openai_prompt: string;
    openai_append_prompt: string;
}