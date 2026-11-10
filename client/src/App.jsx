import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Subjects from './pages/Subjects.jsx';
import Grades from './pages/Grades.jsx';
import Attendance from './pages/Attendance.jsx';
import Tasks from './pages/Tasks.jsx';
import Justifications from './pages/Justifications.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';

/** Ruta protegida: exige sesión y, opcionalmente, un rol permitido (RBAC en el cliente). */
function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Restaurando sesión…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/registro" element={<Guest><Register /></Guest>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="notificaciones" element={<Notifications />} />
        <Route path="usuarios" element={<Protected roles={['administrador']}><Users /></Protected>} />
        <Route path="materias" element={<Protected roles={['administrador']}><Subjects /></Protected>} />
        <Route path="calificaciones" element={<Grades />} />
        <Route path="asistencia" element={<Attendance />} />
        <Route path="tareas" element={<Tasks />} />
        <Route path="justificaciones" element={<Protected roles={['apoderado', 'administrador']}><Justifications /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
