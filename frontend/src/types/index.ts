/** Matches the User.to_dict() output from the Flask backend. */
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

/** Matches the Post.to_dict() output from the Flask backend. */
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author: User;
}

/** The paginated response from GET /api/posts */
export interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  pages: number;
}

/** Login response from POST /api/auth/login */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}
