import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
const WORKDIR = process.cwd();
const SKILLS_DIR = `${WORKDIR}/skills`;

class SkillLoader {
    constructor(skillsDir) {
        this.skillsDir = skillsDir;
        this.skills = {};
        this._loadAll();
    }

    _loadAll() {
        if (!fs.existsSync(this.skillsDir)) {
            return;
        }

        const skillFiles = this._findSkillFiles(this.skillsDir);
        for (const file of skillFiles.sort()) {
            const text = fs.readFileSync(file, 'utf8');
            const [meta, body] = this._parseFrontmatter(text);
            const name = meta.name || path.basename(path.dirname(file));
            this.skills[name] = { meta, body, path: file };
        }
        console.log(`Loaded ${Object.keys(this.skills).length} skills`);

    }

    _findSkillFiles(dir) {
        let files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(this._findSkillFiles(fullPath));
            } else if (entry.name === 'SKILL.md') {
                files.push(fullPath);
            }
        }

        return files;
    }

    _parseFrontmatter(text) {
        /** Parse YAML frontmatter between --- delimiters. */
        // 处理不同的换行符格式
        const normalizedText = text.replace(/\r\n/g, '\n');
        const match = normalizedText.match(/^---\n(.*?)\n---\n(.*)/s);
        if (!match) {
            return [{}, text];
        }

        try {
            const meta = yaml.load(match[1]) || {};
            return [meta, match[2].trim()];
        } catch (error) {
            return [{}, text];
        }
    }

    getDescriptions() {
        /** Layer 1: short descriptions for the system prompt. */
        if (Object.keys(this.skills).length === 0) {
            return "(no skills available)";
        }

        const lines = [];
        for (const [name, skill] of Object.entries(this.skills)) {
            const desc = skill.meta.description || "No description";
            const tags = skill.meta.tags || "";
            let line = `  - ${name}: ${desc}`;
            if (tags) {
                line += ` [${tags}]`;
            }
            lines.push(line);
        }
        return lines.join('\n');
    }

    getContent({ name }) {
        /** Layer 2: full skill body returned in tool_result. */
        const skill = this.skills[name];
        if (!skill) {
            return `Error: Unknown skill '${name}'. Available: ${Object.keys(this.skills).join(', ')}`;
        }
        return `<skill name="${name}">\n${skill.body}\n</skill>`;
    }
}


const skillLoader = new SkillLoader(SKILLS_DIR);
export default skillLoader;
