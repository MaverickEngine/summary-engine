<script lang="ts">
    export let id: string | null | undefined = null;
    export let name: string | null | undefined = null;
    export let label = "";
    export let type = "text";
    export let value: string | number | null | undefined = "";
    export let placeholder = "";
    export let description = "";
    export let required = false;
    export let readonly = false;
    export let disabled = false;
    export let options: any = [];
    export let multiple = false;
    export let checked = false;
    export let min: number | string | null = null;
    export let max: number | string | null = null;
    export let step: number | null = null;
    export let pattern: string | null = null;
    export let rows: number | null = null;
    export let cols: number | null = null;
    export let wrap: string | null = null;

    $: if (type === "date" && value) {
        value = parse_date(value);
        if (min) min = parse_date(min);
        if (max) max = parse_date(max);
    }

    function parse_date(d: string | Date | number): string {
        const date = new Date(d);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}-${month.toString().padStart(2, "0")}-${day
            .toString()
            .padStart(2, "0")}`;
    }
</script>

{#if type === "hidden"}
    <input
        bind:value
        type="hidden"
        {id}
        {name}
        {required}
        {readonly}
        {disabled}
    />
{:else}
    <tr>
        <th scope="row">
            <label for={id}>{label}</label>
        </th>
        <td>
            {#if type === "text"}
                <input
                    bind:value
                    type="text"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {placeholder}
                    {required}
                    {readonly}
                    {disabled}
                    {pattern}
                />
            {:else if type === "password"}
                <input
                    bind:value
                    type="password"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {pattern}
                />
            {:else if type === "email"}
                <input
                    bind:value
                    type="email"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {pattern}
                />
            {:else if type === "url"}
                <input
                    bind:value
                    type="url"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {pattern}
                />
            {:else if type === "tel"}
                <input
                    bind:value
                    type="tel"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {pattern}
                />
            {:else if type === "number"}
                <input
                    bind:value
                    type="number"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "range"}
                <input
                    bind:value
                    type="range"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "date"}
                <input
                    bind:value
                    type="date"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "month"}
                <input
                    bind:value
                    type="month"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "week"}
                <input
                    bind:value
                    type="week"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "time"}
                <input
                    bind:value
                    type="time"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "datetime-local"}
                <input
                    bind:value
                    type="datetime-local"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {min}
                    {max}
                    {step}
                />
            {:else if type === "color"}
                <input
                    bind:value
                    type="color"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                />
            {:else if type === "checkbox"}
                <input
                    bind:checked
                    type="checkbox"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                />
            {:else if type === "radio"}
                {#each options as option}
                    <input
                        bind:group={value}
                        type="radio"
                        name={option.name}
                        value={option.value}
                    />&nbsp;{option.label}<br />
                {/each}
            {:else if type === "file"}
                <input
                    bind:value
                    type="file"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                />
            {:else if type === "submit"}
                <input
                    value={label}
                    type="submit"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {disabled}
                />
            {:else if type === "reset"}
                <input
                    value={label}
                    type="reset"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {disabled}
                />
            {:else if type === "button"}
                <input
                    value={label}
                    type="button"
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {disabled}
                />
            {:else if type === "select"}
                {#if multiple}
                    <select
                        bind:value
                        {id}
                        class={$$restProps.class || ""}
                        {name}
                        multiple
                    >
                        {#each options as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                {:else}
                    <select
                        bind:value
                        {id}
                        class={$$restProps.class || ""}
                        {name}
                    >
                        {#each options as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                {/if}
            {:else if type === "textarea"}
                <textarea
                    bind:value
                    {id}
                    class={$$restProps.class || ""}
                    {name}
                    {required}
                    {readonly}
                    {disabled}
                    {rows}
                    {cols}
                    {wrap}
                ></textarea>
            {/if}
            {#if description}
                <p class="description">{description}</p>
            {/if}
        </td>
    </tr>
{/if}
