import YAML from "yaml";
import fs from 'node:fs';
import path from "node:path";
const defaultConfig = fs.readFileSync(require.resolve('./default-config.yml'), 'utf8');

export const configPath = path.resolve('./config.yml');
export function parseConfig() {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, defaultConfig);
    if (process.argv[2]) {
        const file = fs.readFileSync(configPath, 'utf8');
        fs.writeFileSync(configPath, file.replace('token: \'\'', `token: ${process.argv[2]}`))
    }
    const data = YAML.parse(fs.readFileSync(configPath, 'utf8'));
    return data;
}
export async function validateConfig(obj, data, client, keyPath = 'config') {
    for (const [key, realVal] in Object.entries(obj)) {
        const keyId = keyPath + `['${key}']`;
        const value = !Array.isArray(realVal) 
            ? [[realVal], {}]
            : !Array.isArray(realVal[0])
                ? [realVal, {}]
                : realVal;
        let hasGoodType;
        let typeError = `Bad Key ${keyId}: Expected type ${value}, got ${typeof data[key]} instead`;
        for (const type of realVal[0]) {
            if (typeof value === 'object') { 
                const ret = await validateConfig(value, data[key], client, keyId); 
                if (typeof ret !== 'string') hasGoodType = true;
                if (typeof ret === 'string') typeError = ret;
                continue; 
            }
            if (typeof data[key] === type) hasGoodType = true;
        }
        if (!hasGoodType) return typeError;
        if (value[1].dependsOn) {
            if (!data[value[1].dependsOn])
                return `Missing Dependency for ${keyId}, requires ${value[1].dependsOn}`;
        }
        switch (value[1].mustBe) {
        case 'folder': {
            const stats = await fs.stat(data[key]).catch(() => {});
            if (!stats) break;
            if (!stats.isDirectory()) 
                return `Bad Reference in ${keyId}, expected a directory but got a file instead`;
            break;
        }
        case 'real-folder': {
            const stats = await fs.stat(data[key]).catch(() => {});
            if (!stats) return `Bad Reference in ${keyId}, expected an already existing directory`;
            if (!stats.isDirectory()) 
                return `Bad Reference in ${keyId}, expected a directory but got a file instead`;
            break;
        }
        case 'file': {
            const stats = await fs.stat(data[key]).catch(() => {});
            if (!stats) break;
            if (!stats.isFile()) 
                return `Bad Reference in ${keyId}, expected a file but got a directory instead`;
            break;
        }
        case 'real-file': {
            const stats = await fs.stat(data[key]).catch(() => {});
            if (!stats) return `Bad Reference in ${keyId}, expected an already existing file`;
            if (!stats.isFile()) 
                return `Bad Reference in ${keyId}, expected a file but got a directory instead`;
            break;
        }
        case 'guild':
            if (!client.askFor('Guilds.get', data[key]))
                return `Bad Reference in ${keyId}, expected a server that this user is inside of`;
            break;
        case 'channel':
            if (!client.askFor('Channels.get', data[key]))
                return `Bad Reference in ${keyId}, expected a server that this user is inside of`;
            break;

        default:break;
        }
    }
}