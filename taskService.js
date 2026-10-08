const repository = require('./taskRepository');

class TaskError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const notFound = (id) => new TaskError(404, `Task ${id} not found`);

module.exports = {
  list: () => repository.list(),
  async get(id, label) {
    const task = await repository.get(id);
    if (!task) throw notFound(label);
    return task;
  },
  async create(body) {
    const title = body?.title;
    if (typeof title !== 'string' || !title.trim()) {
      throw new TaskError(400, 'title must be a nonempty string');
    }
    return repository.create(title.trim());
  },
  async update(id, label, body) {
    const existing = await repository.get(id);
    if (!existing) throw notFound(label);

    const validBody = body && typeof body === 'object' && !Array.isArray(body);
    const keys = validBody ? Object.keys(body) : [];
    if (!keys.length || keys.some((key) => !['title', 'done'].includes(key)) ||
        ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) ||
        ('done' in body && typeof body.done !== 'boolean')) {
      throw new TaskError(400, 'Provide a nonempty title and/or a boolean done');
    }

    const title = 'title' in body ? body.title.trim() : existing.title;
    const done = 'done' in body ? body.done : existing.done;
    const updated = await repository.update(id, { title, done });
    if (!updated) throw notFound(label);
    return updated;
  },
  async remove(id, label) {
    if (!(await repository.remove(id))) throw notFound(label);
  },
};
