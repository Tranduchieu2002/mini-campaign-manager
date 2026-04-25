// Properties that are needed for a user creation
export interface CreateUserProps {
  email: string;
  name: string;
}

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
