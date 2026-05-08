import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <>
      <TopBar />
      <div className="app-body">
        <Sidebar />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </>
  )
}
