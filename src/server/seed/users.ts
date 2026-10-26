import type { User } from "../auth/users";

const DAY = 86_400_000;

export const DEMO_EMPLOYEE_EMAIL = "ana.souza@nexo.com.br";

/** 7 funcionários (nomes do protótipo) e 2 analistas. Datas relativas ao momento da carga. */
export function seedUsers(now: Date): User[] {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString();
  const createdAt = at(400);
  const employee = (id: string, name: string, email: string, department: string, deviceModel: string, deviceOs: string, pwdDays: number): User => ({
    id,
    name,
    email,
    role: "funcionario",
    department,
    deviceModel,
    deviceOs,
    analystLevel: null,
    passwordChangedAt: at(pwdDays),
    createdAt,
  });
  const analyst = (id: string, name: string, email: string, level: "N1" | "N2"): User => ({
    id,
    name,
    email,
    role: "analista",
    department: "Service desk de TI",
    deviceModel: null,
    deviceOs: null,
    analystLevel: level,
    passwordChangedAt: at(20),
    createdAt,
  });
  return [
    employee("u-ana", "Ana Souza", DEMO_EMPLOYEE_EMAIL, "Financeiro", "Notebook Dell Latitude 5440", "Windows 11", 42),
    employee("u-carla", "Carla Mendes", "carla.mendes@nexo.com.br", "Comercial", "MacBook Air M3", "macOS 15", 12),
    employee("u-bruno", "Bruno Tavares", "bruno.tavares@nexo.com.br", "Logística", "Notebook Lenovo ThinkPad E14", "Windows 10", 70),
    employee("u-diego", "Diego Ramos", "diego.ramos@nexo.com.br", "Marketing", "Notebook Dell Latitude 5440", "Windows 11", 5),
    employee("u-elisa", "Elisa Prado", "elisa.prado@nexo.com.br", "Jurídico", "Notebook HP EliteBook 840", "Windows 11", 33),
    employee("u-fabio", "Fábio Nunes", "fabio.nunes@nexo.com.br", "Engenharia", "Notebook Lenovo ThinkPad T14", "Ubuntu 24.04", 88),
    employee("u-gabriela", "Gabriela Rocha", "gabriela.rocha@nexo.com.br", "RH", "Notebook Dell Latitude 5440", "Windows 11", 21),
    analyst("u-rafael", "Rafael Lima", "rafael.lima@nexo.com.br", "N2"),
    analyst("u-juliana", "Juliana Costa", "juliana.costa@nexo.com.br", "N1"),
  ];
}
