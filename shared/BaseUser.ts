export interface BaseUser {
  id: string;
  role: "admin" | "company_admin" | "customer";
}