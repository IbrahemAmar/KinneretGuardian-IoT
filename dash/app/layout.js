import './globals.css';

export const metadata = {
  title: 'KinneretGuardian — Hydrodynamic Control Center',
  description: 'Wave forecasting · ARX Analysis · Artificial Intelligence · Lake Kinneret',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: '#060e1c' }}>
        {children}
      </body>
    </html>
  );
}
