<script>
    import { posts, types, selected_date, page, post_count, loading, search } from './stores.js';
    import { onMount } from 'svelte';
    import Summarise from "./components/Summarise.svelte";
    import Dates from "./components/Dates.svelte";
    import Pages from "./components/Pages.svelte";
    import Search from "./components/Search.svelte";
    import { apiGet, apiPost } from 'wp-ajax';
    import Modal from './components/Modal.svelte';

    let per_page = 10;
    let summarising_all = false;
    let show_modal = false;
    let modal_url = "";

    async function getPosts () {
        try {
            $loading = true;
            const result = await apiGet(`/summaryengine/v1/posts?date=${$selected_date}&size=${per_page}&page=${$page}&search=${$search}`);
            posts.set(result.posts);
            post_count.set(result.count);
            $loading = false;
        } catch (err) {
            alert("An error occured loading the posts: " + err);
            console.error(err);
            $loading = false;
        }
    }

    async function getTypes () {
        $types = await apiGet(`/summaryengine/v1/types`);
    }

    function checkSummariesSet(post) {
        let found = true;
        for (let slug in post.summaries) {
            if (!post.summaries[slug]?.summary) {
                found = false;
                break;
            }
        }
        return found;
    }

    async function generateAllSummaries(post) {
        // console.log(post);
        summarising_all = true;
        for (let type of $types) {
            const summary = post.summaries[type.slug];
            try {
                if (!summary) continue;
                if (summary.summary) continue;
                summary.summarising = true;
                $posts = $posts;
                const result = await apiPost(`/summaryengine/v1/summarise`, { type_id: type.ID, post_id: post.id });
                if (!result?.summary) throw "No summary returned";
                post.summaries[type.slug].summary = result.summary;
                post.summaries[type.slug].summary_id = result.ID;
                post.summaries[type.slug].summary_details = result;
                post.summaries[type.slug].summary_details.rating = 0;
                // console.log(post);
                $posts = $posts;
                summary.summarising = false;
            } catch (err) {
                console.error(err);
                alert("An error occured: " + err);
                summary.summarising = false;
            }
        }
        summarising_all = false;
        $posts = $posts;
    }

    onMount(async () => {
        try {
            await getTypes();
            await getPosts();
        } catch (e) {
            console.error(e);
        }
    });

    async function reset() {
        $page = 1;
        await getPosts();
    }

    function showIframe(url) {
        modal_url = url;
        show_modal = true;
    }
</script>
{#if show_modal}
    <Modal on:close={() => show_modal = false}>
        <iframe title="Preview" src="{modal_url}" style="width: 100%; height: 80vh"/>
    </Modal>
{/if}
<div id="summaryEngineMetaBlock">
    <div id="summaryEngineMetaBlockSummariseButtonContainer">
        <div id="summaryEngineMetaBlockSummariseButtonContainerLeft">
            <Dates on:click={reset} />
        </div>
        <div id="summaryEngineMetaBlockSummariseButtonContainerRight">
            <div id="summaryEngineSearchContainer" class="summary-engine-margin-bottom-5">
                <Search on:search={reset} />
            </div>
            <div id="summaryEnginePagesContainer">
                <Pages per_page={per_page} on:click={getPosts} on:change={getPosts} />
            </div>
        </div>
    </div>
    <table class="wp-list-table widefat fixed striped table-view-list" class:loading={$loading}>
        <thead>
            <tr>
                <th class="summaryengine-col-10px">Title</th>
                <th class="summaryengine-col-10px">Date</th>
                <th class="summaryengine-col-10px">Author</th>
                {#each $types as type}
                    <th>{type.name}</th>
                {/each}
                <th></th>
            </tr>
        </thead>
        <tbody>
            {#each $posts as post}
                <tr>
                    <td>
                        <span class="dashicons dashicons-welcome-view-site" on:click={() => showIframe(post.permalink)} on:keydown={() => showIframe(post.permalink)} style="cursor:pointer">
                            <span class="screen-reader-text">View Post</span>
                        </span>
                        <a href="/wp-admin/post.php?post={post.id}&action=edit">{post.post_title || "Untitled"}</a>
                    </td>
                    <td>{post.post_date}</td>
                    <td>{post.post_author}</td>
                    {#each $types as type}
                        <td>
                            <Summarise type_id={type.ID} post={post} summary={post.summaries[type.slug]} custom_action={type.custom_action} />
                        </td>
                    {/each}
                    <td>
                        {#if !checkSummariesSet(post)}
                            {#if (summarising_all)}
                                <button class="button summaryengine-summarise-all" disabled="disabled">Summarising...</button>
                            {:else}
                                <button class="button summaryengine-summarise-all" on:click={() => generateAllSummaries(post)}>Summarise All</button>
                            {/if}
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style lang="less">
    .summaryengine-col-10px {
        width: 10%;
    }

    #summaryEngineMetaBlockSummariseButtonContainer {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    #summaryEngineMetaBlockSummariseButtonContainerLeft {
        display: flex;
        flex-direction: row;
        justify-content: left;
        align-items: flex-end;
    }

    #summaryEngineMetaBlockSummariseButtonContainerRight {
        display: flex;
        flex-direction: column;
        justify-content: right;
    }

    .summary-engine-margin-bottom-5 {
        margin-bottom: 5px;
    }

    table.loading {
        opacity: 0.5;
    }

    .summaryengine-summarise-all {
        margin-top: 10px;
    }
</style>