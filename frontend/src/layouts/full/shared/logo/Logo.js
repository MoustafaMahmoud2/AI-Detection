import { Link } from 'react-router-dom';
import { styled, Typography } from '@mui/material';

const LinkStyled = styled(Link)(() => ({
  height: '70px',
  width: '200px',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
}));

const Logo = () => {
  return (
    <LinkStyled to="/">
      <Typography variant="h3" fontWeight="900" color="primary.main">
        ProctorAI
      </Typography>
    </LinkStyled>
  );
};

export default Logo;
