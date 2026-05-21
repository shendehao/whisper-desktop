import http from "./index";

export interface LoginResponse {
  code: number;
  message: string;
  token: string;
  username: string;
  user_id: number;
  role: "superadmin" | "admin" | "sub_account";
  parent_id: number | null;
  permissions: string[];
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await http.post("/api/packer_login", { username, password });
    return data;
  },
};
