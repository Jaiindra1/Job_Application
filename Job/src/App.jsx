import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import SavedJobs from './components/SavedJobs';
import Dashboard from './components/Dashboard';
import FindJob from './components/FindJob';
import Applications from './components/Applications';
import Companies from './components/Companies';
import Profile from './components/Profile';
import Resume from './components/Resume';
import Skills from './components/Skills';
import Autoapply from './components/Autoapply';
import Login from './Security/Login';
import Signup from './Security/signup';
import ResetPassword from './Security/ResetPassword';
import { Navigate } from 'react-router-dom';
import { loggedIn } from './Security/auth';
import JobDetails from './components/JobDetails';
import ApplicationDetails from './components/ApplicationDetails';
import NotificationBell from './components/NotificationBell';

const Protected = ({children}) => loggedIn() ? <><NotificationBell/>{children}</> : <Navigate to="/login" replace />;
import "./index.css";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/find-jobs" element={<Protected><FindJob /></Protected>} />
        <Route path="/jobs/:id" element={<Protected><JobDetails /></Protected>} />
        <Route path="/saved-jobs" element={<Protected><SavedJobs /></Protected>} />
        <Route path="/applications" element={<Protected><Applications /></Protected>} />
        <Route path="/applications/:id" element={<Protected><ApplicationDetails /></Protected>} />
        <Route path="/companies" element={<Protected><Companies /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/resume" element={<Protected><Resume /></Protected>} />
        <Route path="/skills-insights" element={<Protected><Skills /></Protected>} />
        <Route path="/auto-apply" element={<Protected><Autoapply /></Protected>} />
      </Routes>
    </Router>
  )
}

export default App
