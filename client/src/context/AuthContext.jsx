import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("hrms_user") || "null"));
  const [company, setCompany] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("hrms_token")));

  const refreshMe = async () => {
    if (!localStorage.getItem("hrms_token")) {
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCompany(data.company);
      setEmployee(data.employee);
      localStorage.setItem("hrms_user", JSON.stringify(data.user));
      return data;
    } catch {
      localStorage.removeItem("hrms_token");
      localStorage.removeItem("hrms_user");
      setUser(null);
      setCompany(null);
      setEmployee(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshMe(); }, []);

  const login = ({ token, user: nextUser, company: nextCompany }) => {
    localStorage.setItem("hrms_token", token);
    localStorage.setItem("hrms_user", JSON.stringify(nextUser));
    setUser(nextUser);
    setCompany(nextCompany || null);
  };

  const logout = () => {
    localStorage.removeItem("hrms_token");
    localStorage.removeItem("hrms_user");
    setUser(null);
    setCompany(null);
    setEmployee(null);
  };

  const hasPermission = (permission) => Boolean(user?.permissions?.includes(permission));
  const value = useMemo(() => ({ user, company, employee, loading, login, logout, hasPermission, refreshMe }), [user, company, employee, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
