import YAML from "yaml";
import fs from 'node:fs';
import path from "node:path";
const defaultConfig = fs.readFileSync(path.resolve(__dirname, './default-config.yml'), 'utf8');

export const configPath = path.resolve(publicAsset, './config.yml');
function camalCaseKeys(object) {
    if (typeof object !== 'object') return object;
    const out = {};
    for (const key in object) {
        const parts = key.split('-')
        for (let i = 0, part = parts[0]; i < parts.length; part = parts[++i]) {
            if (i === 0) continue;
            parts[i] = part[0].toUpperCase();
            parts[i] += part.slice(1);
        }
        out[parts.join('')] = camalCaseKeys(object[key]);
    }
    return out;
}
export function parseConfig() {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, defaultConfig);
    if (process.argv[2]) {
        const file = fs.readFileSync(configPath, 'utf8');
        fs.writeFileSync(configPath, file.replace('token: \'\'', `token: ${process.argv[2]}`))
    }
    const data = YAML.parse(fs.readFileSync(configPath, 'utf8'));
    return camalCaseKeys(data);
}