const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data.json');

class Storage {
  constructor(filePath = DATA_FILE) {
    this.filePath = filePath;
    this.data = { prompts: {} };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load data file, starting fresh', err);
      this.data = { prompts: {} };
    }
  }

  persist() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  generateId(length = 8) {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
  }

  createPrompt(topic) {
    const id = this.generateId(6);
    const prompt = {
      id,
      topic,
      createdAt: new Date().toISOString(),
      answers: []
    };
    this.data.prompts[id] = prompt;
    this.persist();
    return prompt;
  }

  getPrompt(id) {
    return this.data.prompts[id] || null;
  }

  addAnswer(promptId, { author, text }) {
    const prompt = this.getPrompt(promptId);
    if (!prompt) return null;
    const answer = {
      id: this.generateId(6),
      author: author?.trim() || '匿名',
      text,
      createdAt: new Date().toISOString(),
      votes: { funny: 0, meh: 0 }
    };
    prompt.answers.push(answer);
    this.persist();
    return answer;
  }

  recordVerdict(promptId, answerId, verdict) {
    const prompt = this.getPrompt(promptId);
    if (!prompt) return null;
    const answer = prompt.answers.find((a) => a.id === answerId);
    if (!answer) return null;
    if (verdict === 'funny') {
      answer.votes.funny += 1;
    } else if (verdict === 'meh') {
      answer.votes.meh += 1;
    } else {
      return null;
    }
    this.persist();
    return answer;
  }
}

module.exports = new Storage();
