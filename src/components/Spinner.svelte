<div class="summaryengine-spinner">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
</div>

<style lang="less">
    .summaryengine-spinner {
        height: 32px;
        width: 32px;
    }

    .summaryengine-spinner div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 32px;
        height: 32px;
        margin: 4px;
        border: 4px solid #444;
        border-radius: 50%;
        animation: summaryengine-spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #444 transparent transparent transparent;
      }
      
      .summaryengine-spinner div:nth-child(1) {
        animation-delay: -0.45s;
      }
      
      .summaryengine-spinner div:nth-child(2) {
        animation-delay: -0.3s;
      }
      
      .summaryengine-spinner div:nth-child(3) {
        animation-delay: -0.15s;
      }
      
      @keyframes summaryengine-spinner {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
</style>