-- Executado uma única vez na criação do container local.
-- Cria a role somente leitura usada pela Iris (espelha a configuração do Neon).
CREATE ROLE iris_reader WITH LOGIN PASSWORD 'iris_reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE decoding TO iris_reader;
GRANT USAGE ON SCHEMA public TO iris_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE decoding_owner IN SCHEMA public GRANT SELECT ON TABLES TO iris_reader;
