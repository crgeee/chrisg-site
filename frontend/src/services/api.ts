/**
 * Centralized API client for all backend communication.
 *
 * Stores JWT tokens in memory (not localStorage) for security.
 * Automatically attaches the access token to authenticated requests.
 * Handles token refresh when the access token expires.
 */

import type { AuthResponse, Post, PostListResponse, User } from "../types";

const API_BASE = "/api";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}`,
      },
    });

    if (refreshed.ok) {
      const data = await refreshed.json();
      accessToken = data.access_token;
      headers["Authorization"] = `Bearer ${accessToken}`;
      return fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
    }
  }

  return response;
}

// --- Auth ---

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data: AuthResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<User> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// --- Posts (public) ---

export async function getPosts(page = 1): Promise<PostListResponse> {
  const res = await apiFetch(`/posts?page=${page}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

export async function getPost(slug: string): Promise<Post> {
  const res = await apiFetch(`/posts/${slug}`);
  if (!res.ok) throw new Error("Post not found");
  return res.json();
}

// --- Posts (admin) ---

export async function getDrafts(): Promise<{ posts: Post[] }> {
  const res = await apiFetch("/posts/drafts");
  if (!res.ok) throw new Error("Failed to fetch drafts");
  return res.json();
}

export async function createPost(post: Partial<Post>): Promise<Post> {
  const res = await apiFetch("/posts", {
    method: "POST",
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json();
}

export async function updatePost(slug: string, data: Partial<Post>): Promise<Post> {
  const res = await apiFetch(`/posts/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update post");
  return res.json();
}

export async function deletePost(slug: string): Promise<void> {
  const res = await apiFetch(`/posts/${slug}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete post");
}
