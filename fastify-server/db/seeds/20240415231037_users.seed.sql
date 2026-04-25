-- migrate:up
INSERT INTO
  users (
    "id",
    "email",
    "name",
    "createdAt",
    "updatedAt",
  )
VALUES
  (
    'f59d0748-d455-4465-b0a8-8d8260b1c877',
    'john@gmail.com',
    'John Doe',
    now(),
    now(),
  );

-- migrate:down
DELETE FROM users WHERE id='f59d0748-d455-4465-b0a8-8d8260b1c877'
