import { Link, useLocation } from 'react-router-dom';

export default function Breadcrumbs () {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb-nav">
      <ol className="flex list-none p-0">
        <li className="breadcrumb-item">
          <Link title="Home" to="/">Home</Link>
        </li>
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          return (
            <li key={to} className={`breadcrumb-item ${last ? 'active' : ''}`}>
              <span className="separator"> / </span>
              {last ? (
                <span aria-current="page">{value.replace(/-/g, ' ')}</span>
              ) : (
                <Link to={to}>{value.replace(/-/g, ' ')}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
