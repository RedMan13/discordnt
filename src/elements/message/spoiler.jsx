export const TextSpoiler = <define 
    extends="span"
    style="
        border-radius: 3px;
        color: transparent;
        background-color: rgb(30, 31, 34);
    "
    on:click={() => {
        this.style.color = 'inherit';
        this.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
    }}
/>