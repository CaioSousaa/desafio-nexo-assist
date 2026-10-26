import { redirect } from "next/navigation";

// O proxy já manda para /chat ou /console conforme o perfil; sem sessão, para /login.
export default function Home() {
  redirect("/login");
}
