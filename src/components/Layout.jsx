import BackgroundVideo from './BackgroundVideo';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <BackgroundVideo />
      <div className="app-content">{children}</div>
    </div>
  );
}