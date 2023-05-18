export interface IType {
    ID: number;
    created_at?: Date;
    name: string;
    slug: string;
    openai_method: string;
    openai_model: string;
    openai_system: string;
    word_limit: number;
    cut_at_paragraph: Boolean;
    openai_frequency_penalty: number;
    openai_max_tokens: number;
    openai_presence_penalty: number;
    openai_temperature: number;
    openai_top_p: number;
    prompt: string;
    append_prompt: string;
    custom_action: string;
}