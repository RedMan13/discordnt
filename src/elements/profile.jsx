import { Asset, gifOrWebp } from "../api/asset-helper";

export class UserAvatar extends HTMLElement {
    constructor() {
        super();
        client.askFor('Members.on', 'set', (key, member) => {
            if (member.user_id === this.user)
                this.render(true);
        });
        client.askFor('Users.on',  'set', (key, user) => {
            if (key === this.user)
                this.render(false);
        });
    }
    async render(member) {
        if (!this.img) {
            if (!member && client.askFor('guild'))
                client.askFor('getMember', client.askFor('guild'), this.user)
                    .then(member => this.render(member));
            if (typeof member === 'boolean')
                member = await client.askFor('getMember', this.user);
            member ??= await client.askFor('getUser', this.user);
        }
        if (!member && !this.img) return;
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
        for (const child of this.shadowRoot.children)
            child.remove();
        this.shadowRoot.appendChild(<div
            style="
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
            "
        >
            <img
                src={this.img
                    ? this.img
                    : member.avatar
                        ? member.alt_avatar
                            ? Asset.GuildMemberAvatar(member, gifOrWebp(member.alt_avatar), 256)
                            : Asset.UserAvatar(member, gifOrWebp(member.avatar), 256)
                        : Asset.DefaultUserAvatar(((+this.user[0]) % 6), 'png', 256)}
                style={`
                    border-radius: 50%; 
                    height: calc(100% * 0.7903788659793815);
                    aspect-ratio: 1;
                    position: relative;
                    ${member?.avatar_decoration_data ? 'left: 50%;' : ''}
                `}
            />
            {member?.avatar_decoration_data
                ? Asset.AvatarDecoration(member.avatar_decoration_data, 'png', 256, ` 
                    position: relative;
                    height: 100%;
                    aspect-ratio: 1;
                    left: calc(-50% + ((100% - (100% * 0.7903788659793815)) / 2));
                `)
                : null}
        </div>);
    }
    static observedAttributes = ['user', 'src'];
    attributeChangedCallback(key, old, val) {
        switch (key) {
        case 'user': this.user = val; break;
        case 'src': this.img = val; break;
        }

        if (!this.rendered) return;
        this.render();
    }
    async connectedCallback() {
        await this.render();
        this.rendered = true;
    }
}
customElements.define('discord-user-avatar', UserAvatar);