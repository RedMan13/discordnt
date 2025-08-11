import { format, styles, highlighter } from './render-md.jsx';
import { Asset } from '../../api/asset-helper.js';
import { TimeStamp } from './timestamp.jsx';
import { Username } from '../username.jsx';
import { UserAvatar } from '../profile.jsx';

export class DiscordMessage extends HTMLElement {
    message = null
    reply = false;
    rendered = false;
    client = null;
    constructor() {
        super();
    }
    async getEmbeds(message) {
        message ??= this.client.askFor('Messages.get', this.message);
        if (this.reply && message.embeds.length)
            return ['<Click to view Embed>'];
        if (this.reply && message.attachments.length)
            return ['<Click to view Attachment>'];
        const embeds = [];
        for (const embed of message.embeds.reduce((c,v) => {
            if (Object.keys(v).length === 3 && 'image' in v) {
                c.at(-1).images.push(v.image);
                return c;
            }
            c.push({ ...v, images: v.image ? [v.image] : [] });
            return c;
        }, []).concat(message.attachments)) {
            switch (embed.type ?? embed.content_type?.split?.('/', 2)?.[0]) {
            default: break;
            case 'poll_result': break;
            case 'audio':
                break;  
            case 'text':
                const content = await fetch(embed.proxy_url);
                highlighter(embed.content_type, content);
                break; 
            case 'video':
                embeds.push(<div style="
                    border-radius: 3px;
                    margin: 1px 0px;
                    max-width: 335px;
                    overflow: hidden;
                ">
                    <video 
                        style="max-width: 100%;" 
                        autoplay={false}
                        loop={false} 
                        controls={true}
                    >
                        <source src={embed.proxy_url} />
                    </video>
                </div>);
                break;
            case 'image':
            case 'gifv':
                embeds.push(<div style="
                    border-radius: 3px;
                    margin: 1px 0px;
                    max-width: 335px;
                    overflow: hidden;
                ">
                    {embed.proxy_url ? <img style="max-width: 100%;" src={embed.proxy_url}/> : null}
                    {embed.thumbnail && !embed.video ? <img 
                        style="max-width: 100%;" 
                        src={embed.thumbnail.proxy_url}
                    /> : null}
                    {embed.video ? <video 
                        style="max-width: 100%;" 
                        autoplay={true}
                        loop={true} 
                        controls={false}
                    >
                        <source src={embed.video.proxy_url} />
                        {embed.thumbnail ? <img src={embed.thumbnail.proxy_url} style="max-width: 100%;"></img> : null}
                    </video> : null}
                </div>);
                break;
            case 'link':
            case 'article':
            case 'rich':
                const color = embed.color 
                    ? '#' + embed.color.toString(16).padStart(6, '0')
                    : 'grey';
                const author = embed.author ? [
                    embed.author.icon_url ? <img 
                        style="
                            display: inline-block;
                            width: calc(1rem + 1px);
                            height: calc(1rem + 1px);
                            clip-path: circle();
                            vertical-align: sub;
                        "
                        src={embed.author.proxy_icon_url}
                    /> : null,
                    embed.author.name ? <span style={`
                        font-size: 0.9rem;
                        padding: 0 4px;
                    `}>{embed.author.name}</span> : null,
                    <br/>
                ] : null;
                embeds.push(<div
                    style={`
                        padding: .5rem;
                        border-left: 3px solid ${color};
                        border-radius: 3px;
                        background-color: #EEeeEE;
                        margin: 1px 0px;
                        width: ${embed.thumbnail ? '100%' : 'max-content'};
                        max-width: 335px;
                        ${embed.thumbnail ? 'min-height: 3.5rem;' : ''}
                    `}
                >
                    {embed.thumbnail ? <img 
                        style="
                            display: inline-block;
                            float: right;
                            width: 3.5rem;
                            height: 3.5rem;
                            object-fit: contain;
                            border-radius: 3px;
                        " 
                        src={embed.thumbnail.proxy_url} 
                    /> : null}
                    {embed.author 
                        ? embed.author.url 
                            ? <a 
                                href={`/redirect?target=${embed.author.url}`} 
                                style="margin-bottom: 4px; display: block;"
                            >{author}</a> 
                            : <div style="margin-bottom: 4px; display: block;">{author}</div>
                        : null}
                    {embed.title ? <span style="margin: .5rem 0px;">{
                        embed.url ? <a href={`/redirect?target=${embed.url}`}>{embed.title}</a> : embed.title
                    }</span> : null}
                    {embed.description ? <span>{await format(embed.description, { client: this.client })}</span> : null}
                    {embed.fields ? await Promise.all(embed.fields.map(async field => <div 
                        style={field.inline
                            ? `
                                display: inline-block;
                                width: 33.33%;
                                height: max-content;
                            `
                            : `height: max-content;`
                        }
                    >
                        <div style="font-weight: 600">{field.name}</div>
                        {await format(field.value, { client: this.client })}
                    </div>)) : null}
                    {embed.images?.length ? <div style={`
                        margin-top: 1rem;
                        display: grid;
                        grid-template-columns: 1fr ${embed.images.length >= 2 ? '1fr' : ''};
                        grid-template-rows: 1fr ${embed.images.length > 2 ? '1fr' : ''};
                        grid-gap: 4px;
                        height: min-content;
                    `}>
                        {embed.images.map(image => <img 
                            src={image.proxy_url} 
                            style="width: 100%; border-radius: 3px" 
                        />)}
                    </div> : null}
                    {embed.video ? <video 
                            style="width: 100%;" 
                            autoplay={embed.type === 'gifv'}
                            loop={embed.type === 'gifv'} 
                            controls={embed.type !== 'gifv'}
                        >
                            <source src={embed.video.proxy_url} />
                            {embed.thumbnail ? <img src={embed.thumbnail.proxy_url} style="max-width: 167.5px;"></img> : null}
                        </video> : null}
                    {embed.footer?.icon_url ? <img 
                        style="
                            display: inline-block;
                            width: 1rem;
                            height: 1rem;
                            clip-path: circle();
                            vertical-align: sub;
                            margin-right: 2px;
                        "
                        src={embed.footer.proxy_icon_url}
                    /> : null}
                    {embed.footer ? <span style="font-size: 0.8rem;">{embed.footer.text}</span> : null}
                    {embed.timestamp ? ['⋅', <TimeStamp style="font-size: 0.8rem;" t={embed.timestamp} s="M"></TimeStamp>] : null}
                </div>);
                break;
            }
        }
        return embeds;
    }
    async render() {
        this.onmouseenter = () => {
            this.style.backgroundColor = '#0000000F';
        }
        this.onmouseleave = () => {
            this.style.backgroundColor = '#00000000';
        }
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [styles];
        this.shadowRoot.innerHTML = '<div></div>';
        this.rendered = true;

        const message = this.client.askFor('Messages.get', this.message) || this.data;
        if (!message) return;
        const avatarSrc = message.author?.avatar 
            ? message.author.avatar.startsWith('http')
                ? message.author.avatar
                : Asset.UserAvatar(message.author, 'webp', '256')
            : null;
        if (this.reply) {
            this.shadowRoot.replaceChild(<div
                style="
                    display: grid;
                    grid-template-columns: 1.1rem auto minmax(auto, 1fr);
                    grid-template-rows: 1lh;
                "
            >
                <UserAvatar 
                    client={this.client}
                    user={message.author_id} 
                    src={avatarSrc}
                    style="
                        width: 1lh;
                        height: 1lh;
                    "
                />
                <Username 
                    style="
                        font-size: 0.8rem;
                        padding: 0 4px;
                        vertical-align: super;
                    "
                    client={this.client}
                    user={message.author_id}
                    name={message.author?.username}
                />
                <span style="font-size: 0.8rem">
                    {await format(message.content, { client: this.client })}
                    {await this.getEmbeds(message)}
                </span>
            </div>, this.shadowRoot.firstChild);
            return;
        }
        const compact = this.client.askFor('isChildMessage', this.message);
        if (compact) {
            this.shadowRoot.replaceChild( 
                <div style="padding-left: calc(2.7rem + 8px); width: 100%;">
                    {await format(message.content, { client: this.client })}
                    {await this.getEmbeds(message)}
                </div>, this.shadowRoot.firstChild
            );
            return;
        }
        this.shadowRoot.replaceChild(<div 
            style="
                display: grid;
                grid-template-rows: auto 1lh auto;
                grid-template-columns: 2.7rem 4px auto;
                padding: 2px 4px;
            "
        >
            {message.message_reference && message.message_reference.type === 0
                ? [
                    <div style="
                        grid-row: 1; grid-column: 1;
                        margin-left: 1rem;
                        margin-top: 0.5lh;
                        border: 1px solid black;
                        border-bottom-width: 0px;
                        border-right-width: 0px;
                        border-top-left-radius: 0.4rem;
                        height: 0.5lh;
                        width: 1rem;
                    "></div>,
                    <div 
                        style="
                            overflow-x: hidden; 
                            grid-row: 1; 
                            grid-column: 3;
                            cursor: pointer;
                        "
                        on:click={() => {
                            const id = message.message_reference.message_id;
                            const targ = document.getElementById(id);
                            if (!targ) {
                                this.client.askFor('goto', id);
                                return;
                            }
                            targ.scrollIntoView(targ);
                        }}
                    >
                        <DiscordMessage 
                            client={this.client}
                            reply={true}
                            id={message.message_reference.message_id} 
                            raw={message.referenced_message}
                        />
                    </div>
                ] 
                : null}
            <UserAvatar 
                style="
                    grid-row: 2 / 4;
                    grid-column: 1 / 2;
                    width: 2.7rem;
                    height: 2.7rem;
                    margin-bottom: -0.2rem;
                "
                client={this.client}
                user={message.author_id} 
                src={avatarSrc}
            />
            <div style="grid-row: 2; grid-column: 3;">
                <Username 
                    client={this.client}
                    user={message.author_id}
                    name={message.author?.username}
                />
                <TimeStamp style="padding-left: 1rem; font-size: 0.7rem" t={message.timestamp} s="M"/>
            </div>
            <div style="grid-row: 3; grid-column: 3;">
                {await format(message.content, { client: this.client })}
                {await this.getEmbeds(message)}
            </div>
        </div>, this.shadowRoot.firstChild);
    }
    static observedAttributes = ['reply', 'id', 'raw', 'client'];
    async attributeChangedCallback(key, oldVal, newVal) {
        switch (key) {
        // in the case of message id, attempt to setup the message content as soon as possible
        case 'id': this.message = newVal; break;
        case 'reply': this.reply = typeof newVal !== 'undefined'; break;
        case 'raw': this.data = newVal; break;
        case 'client': {
            this.client = newVal;
            this.client.askFor('Messages.on', 'set', (id, old, msg) => {
                const message = this.client.askFor('Messages.get', this.message);
                if (!message) return;
                if (msg.id !== message.id && 
                    message.message_reference?.message_id !== msg.id && 
                    msg.id !== this.client.askFor('Messages.get', this.client.askFor('Messages.indexOf', this.message) -1).id)
                    return;
                this.render();
            });
            break;
        }
        }

        if (!this.client) return;
        await this.render();
    }
}
customElements.define('discord-message', DiscordMessage);