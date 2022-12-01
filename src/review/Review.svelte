<script>
    import { posts, types, selected_date, page, post_count, loading, search } from './stores.js';
    import { onMount } from 'svelte';
    import Summarise from "./components/Summarise.svelte";
    import Dates from "./components/Dates.svelte";
    import Pages from "./components/Pages.svelte";
    import Search from "./components/Search.svelte";
    import { apiGet, apiPost } from '../libs/ajax.js';

    let per_page = 10;

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
        let found = false;
        for (let slug in post.summaries) {
            if (post.summaries[slug]?.summary) {
                found = true;
                break;
            }
        }
        return found;
    }

    async function generateAllSummaries(post) {
        // console.log(post);
        for (let type of $types) {
            try {
                if (!post.summaries[type.slug]?.summary) {
                    const result = await apiPost(`/summaryengine/v1/summarise`, { type_id: type.ID, post_id: post.id });
                    if (!result?.summary) throw "No summary returned";
                    post.summaries[type.slug].summary = result.summary;
                    post.summaries[type.slug].summary_id = result.ID;
                    post.summaries[type.slug].summary_details = result;
                    post.summaries[type.slug].summary_details.rating = 0;
                    // console.log(post);
                    $posts = $posts;
                }
            } catch (err) {
                console.error(err);
                alert("An error occured: " + err);
            }
        }
        $posts = $posts;
        // await apiGet(`/summaryengine/v1/generateAllSummaries`);
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
    
</script>

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
                <th class="summaryengine-small-col">Title</th>
                <th class="summaryengine-small-col">Date</th>
                <th class="summaryengine-small-col">Author</th>
                {#each $types as type}
                    <th>{type.name}</th>
                {/each}
                <th></th>
            </tr>
        </thead>
        <tbody>
            {#each $posts as post}
                <tr>
                    <td><a href="{post.permalink}">{post.post_title}</a></td>
                    <td>{post.post_date}</td>
                    <td>{post.post_author}</td>
                    {#each $types as type}
                        <td>
                            <Summarise type_id={type.ID} post_id={post.id} summary={post.summaries[type.slug]} />
                        </td>
                    {/each}
                    <td>
                        {#if !checkSummariesSet(post)}
                            <button on:click={() => generateAllSummaries(post)}>Summarise</button>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style lang="less">
    .summaryengine-small-col {
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
</style>