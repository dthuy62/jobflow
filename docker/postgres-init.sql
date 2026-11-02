-- Development only: these passwords are public and never used anywhere else.
-- A deployed database needs the same two roles and the same owner, because since
-- PostgreSQL 15 only the database owner can create objects in `public`.
CREATE ROLE jobflow_owner LOGIN PASSWORD 'dev-only-owner' CREATEDB;
CREATE ROLE jobflow_app LOGIN PASSWORD 'dev-only-app';
CREATE DATABASE jobflow OWNER jobflow_owner;
