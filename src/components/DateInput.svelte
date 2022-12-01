<script>
    // import { onMount } from 'svelte'
    // import dayjs from 'dayjs'
    import { format as dateFormat, parse as dateParse } from 'date-fns'
  
    export let format = 'yyyy-MM-dd'
      export let date = new Date()
      
    let internal
  
    const input = (x) => (internal = dateFormat(x, format))
    const output = (x) => (date = dateParse(x, format, new Date()))
  
    $: input(date)
    $: output(internal)
  </script>
  
  <input type="date" bind:value={internal} />
  