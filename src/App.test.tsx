import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the Folder City title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '文件夹城市' })).toBeInTheDocument();
});
