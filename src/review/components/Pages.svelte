<script>
    import { page, post_count } from '../stores.js';
    
    export let per_page = 30;
    let page_count = 0;

    $: page_count = Math.ceil($post_count / per_page);

    function nextPage() {
        if ($page < page_count) {
            page.update(n => n+1);
        }
    }

    function lastPage() {
        $page = page_count;
    }

    function prevPage() {
        if ($page > 1) {
            $page--;
        }
    }

    function firstPage() {
        $page = 1;
    }

    function inputPage() {
        if ($page > page_count) {
            $page = page_count;
        }
        if ($page < 1) {
            $page = 1;
        }
    }
</script>

<div class="tablenav-pages">
    <span class="displaying-num">{$post_count} item{ $post_count !== 1 ? "s" : ""}</span>
    <span class="pagination-links">
        <button href="{'#'}" class="first-page button" on:click={firstPage} on:keypress={firstPage} disabled="{($page === 1)}" on:click>
            <span class="screen-reader-text" >First page</span>
            <span aria-hidden="true" >«</span>
        </button>
        <button href="{'#'}" class="prev-page button" on:click={prevPage} on:keypress={prevPage} disabled="{($page === 1)}" on:click>
            <span class="screen-reader-text" >Previous page</span>
            <span aria-hidden="true" >‹</span>
        </button>
        <span class="paging-input">
            <label for="current-page-selector" class="screen-reader-text">Current Page</label>
            <input type="number" bind:value={$page} class="current-page" id="current-page-selector" name="paged" size="2" aria-describedby="table-paging" on:change={inputPage} on:change max={page_count} min="1">
            <span class="tablenav-paging-text">
                 of <span class="total-pages">
                    {page_count}
                </span>
            </span>
        </span>
        <button class="next-page button" on:click={nextPage} on:keypress={nextPage} disabled={($page === page_count)} on:click>
            <span class="screen-reader-text" >Next page</span>
            <span aria-hidden="true" >›</span>
        </button>
        <button class="last-page button" href="{'#'}" on:click={lastPage} on:keypress={lastPage} disabled={($page === page_count)} on:click>
            <span class="screen-reader-text">Last page</span><span aria-hidden="true">»</span>
        </button>
    </span>
</div>