# SQLite exploration

I opened the local `tasks.db` in DB Browser for SQLite and ran these queries in its **Execute SQL** tab. The database contained three temporary demo tasks at the start of this exploration.

```sql
SELECT * FROM tasks;
SELECT * FROM tasks WHERE done = 1;
SELECT COUNT(*) FROM tasks;
UPDATE tasks SET done = 1;
DELETE FROM tasks WHERE done = 1;
```

The first query returned three rows, the completed-task query returned none, and the count was 3. I clicked **Write Changes** after the update; `GET /tasks` then returned all three tasks with `done: true`. I clicked **Write Changes** after the delete; `GET /tasks` then returned `[]`. The database screenshot shows the demo rows before the update and delete.

`tasks.db` is ignored by Git. These queries affect only a local database and do not change the database a reader creates after cloning the repository.
