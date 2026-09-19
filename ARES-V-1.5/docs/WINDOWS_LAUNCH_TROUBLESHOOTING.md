# Windows Launcher Fix — v1.4.1

The original v1.4 launcher could open the browser before the Python HTTP server was ready, causing:

`ERR_CONNECTION_REFUSED`

v1.4.1 fixes this by:

1. detecting a working `python` or `py -3` interpreter;
2. starting the server first;
3. binding explicitly to `127.0.0.1`;
4. polling `http://127.0.0.1:8787/` until the server responds;
5. opening the browser only after the server is confirmed ready;
6. falling back to direct `index.html` mode if Python is unavailable.

If Windows Firewall asks for permission, allow Python on Private networks.
