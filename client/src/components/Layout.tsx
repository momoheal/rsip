import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className="min-h-screen w-full bg-muted/20">
      <Outlet />
    </div>
  );
};

export default Layout;
