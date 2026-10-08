CREATE TABLE tasks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false
);

INSERT INTO tasks (title, done) VALUES
  ('Plan the week', false),
  ('Review API notes', true),
  ('Write a task', false);
