import { Asset } from '../api/asset-helper';

export class Username extends HTMLElement {
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
        if (!this.name) {
            if (!member && client.askFor('guild'))
                client.askFor('getMember', client.askFor('guild'), this.user)
                    .then(member => this.render(member));
            if (typeof member === 'boolean')
                member = await client.askFor('getMember', this.user);
            member ??= await client.askFor('getUser', this.user);
        }
        if (!member) return;
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
        for (const child of this.shadowRoot.children)
            child.remove();
        this.shadowRoot.appendChild(<div style="line-height: normal; width: max-content; display: inline-block;">
            <span style={`color: ${member?.top_role?.color || 'black'}`}>
                {this.name ?? member.username}
            </span>
            {member?.top_role?.irole?.icon ? <img 
                style="
                    margin-left: .25rem;
                    height: 1rem;
                "
                src={Asset.RoleIcon(member.top_role.irole, 'webp', 32)}
            /> : null}
            {member?.top_role?.emoji ? <span
                style="
                    margin-left: .25rem;
                    height: 100%;
                "
            >{member?.top_role?.emoji}</span> : null}
            {member?.bot ? <span style="
                background-color: #86b0ff;
                font-size: 0.8rem;
                padding: 0px 2px;
                border-radius: 4px;
                margin: 0px 2px;
            ">BOT</span> : null}
        </div>);
    }
    static observedAttributes = ['user', 'name'];
    attributeChangedCallback(key, old, val) {
        switch (key) {
        case 'user': this.user = val; break;
        case 'name': this.name = val; break;
        }

        if (!this.rendered) return;
        this.render();
    }
    async connectedCallback() {
        await this.render();
        this.rendered = true;
    }
}
customElements.define('discord-username', Username);