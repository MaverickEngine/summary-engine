<script lang="ts">
    export let type: "button" | "submit" | "reset" = "button";
    export let title: string | null = null;
    export let disabled: boolean = false;
    export let id: string | null = null;
    export let primary: boolean = false;
    export let large: boolean = false;
    export let small: boolean = false;
    export let warning: boolean = false;
    export let danger: boolean = false;
    export let link: boolean = false;
    export let aria_label: string | null = null;
    export let aria_hidden: boolean = false;
    export let btn_class: string = "button";
    let style = "";
    $: if (warning) {
        style = "color: #a00; border-color: #a00;";
    }
    $: if (danger) {
        style = "background-color: #a00; border-color: #a00; color: #fff;";
    }
</script>

<button
    {type}
    {id}
    {title}
    {disabled}
    aria-label={aria_label}
    aria-hidden={aria_hidden}
    class="button {btn_class} {$$restProps.class || ''}"
    class:button-primary={primary}
    class:button-large={large}
    class:button-small={small}
    class:delete={warning}
    class:button-link={link}
    {style}
    on:click
>
    <slot></slot>
</button>
