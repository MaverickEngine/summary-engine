<script>
	import { createEventDispatcher, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher();
	const close = () => dispatch('close');

	let modal;
	let modal_background;

	const handle_keydown = e => {
		if (e.key === 'Escape') {
			close();
			return;
		}

		if (e.key === 'Tab') {
			// trap focus
			const nodes = modal.querySelectorAll('*');
			const tabbable = Array.from(nodes).filter(n => n.tabIndex >= 0);

			let index = tabbable.indexOf(document.activeElement);
			if (index === -1 && e.shiftKey) index = 0;

			index += tabbable.length + (e.shiftKey ? -1 : 1);
			index %= tabbable.length;

			tabbable[index].focus();
			e.preventDefault();
		}
	};

	const previously_focused = typeof document !== 'undefined' && document.activeElement;

	if (previously_focused) {
		onDestroy(() => {
			previously_focused.focus();
		});
	}
</script>

<svelte:window on:keydown={handle_keydown}/>

<div class="modal-background" on:click={close} on:keypress={handle_keydown} bind:this={modal_background}></div>

<div class="modal" role="dialog" aria-modal="true" bind:this={modal}>
	<slot name="header"></slot>
	<slot></slot>
	<div class="modal-footer">
		<slot name="buttons"></slot>
		<!-- svelte-ignore a11y-autofocus -->
		<button class="button" autofocus on:click={close}>Close</button>
	</div>
</div>

<style>
	.modal-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.3);
        z-index: 10000;
	}

	.modal {
		position: fixed;
        left: 50%;
		top: 50%;
		width: calc(100vw - 4em);
		max-width: 90%;
		max-height: calc(100vh - 6em);
		overflow: auto;
		transform: translate(-50%,-50%);
		/* padding: 1em; */
		border-radius: 0.2em;
		background: white;
        z-index: 10001;
	}

	button {
		display: block;
	}

	.modal-footer {
		margin-top: 1em;
		padding: 1em;
		position: sticky;
		border-top: 1px solid rgb(152, 150, 150);
		width: 100%;
		box-sizing: border-box;
	}
</style>