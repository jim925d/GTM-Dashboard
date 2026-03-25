from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, Date, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./revos.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Customer(Base):
    __tablename__ = "customers"
    customer_account = Column(String, primary_key=True, index=True)
    account_id = Column(String, nullable=True)
    mega_vertical = Column(String, nullable=False)
    sub_vertical = Column(String, nullable=True)
    primary_rep = Column(String, nullable=False)
    rep_email = Column(String, nullable=True)
    account_manager = Column(String, nullable=True)
    executive_sponsor = Column(String, nullable=True)
    customer_since = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    annual_revenue = Column(Float, nullable=True)
    employee_count = Column(Integer, nullable=True)
    parent_company = Column(String, nullable=True)
    territory = Column(String, nullable=True)
    segment = Column(String, nullable=True)
    account_tier = Column(String, nullable=True)

    funnel_deals = relationship("FunnelDeal", back_populates="customer")
    close_lost_deals = relationship("CloseLostDeal", back_populates="customer")
    quotes = relationship("Quote", back_populates="customer")
    services = relationship("Service", back_populates="customer")
    locations = relationship("Location", back_populates="customer")


class FunnelDeal(Base):
    __tablename__ = "funnel"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_account = Column(String, ForeignKey("customers.customer_account"), nullable=False, index=True)
    opportunity_name = Column(String, nullable=True)
    product_group = Column(String, nullable=False)
    mrr = Column(Float, nullable=False)
    total_contract_value = Column(Float, nullable=True)
    stage = Column(String, nullable=False)
    forecast_category = Column(String, nullable=False)
    close_date = Column(Date, nullable=False)
    created_date = Column(Date, nullable=False)
    type = Column(String, nullable=False)
    rep = Column(String, nullable=True)
    competitor = Column(String, nullable=True)
    next_step = Column(String, nullable=True)

    customer = relationship("Customer", back_populates="funnel_deals")


class CloseLostDeal(Base):
    __tablename__ = "close_lost"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_account = Column(String, ForeignKey("customers.customer_account"), nullable=False, index=True)
    opportunity_name = Column(String, nullable=True)
    product_group = Column(String, nullable=False)
    mrr = Column(Float, nullable=False)
    total_contract_value = Column(Float, nullable=True)
    close_date = Column(Date, nullable=False)
    created_date = Column(Date, nullable=False)
    type = Column(String, nullable=False)
    stage_lost_from = Column(String, nullable=True)
    loss_reason = Column(String, nullable=False)
    competitor_won = Column(String, nullable=True)
    rep = Column(String, nullable=True)
    loss_notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="close_lost_deals")


class Quote(Base):
    __tablename__ = "quotes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_account = Column(String, ForeignKey("customers.customer_account"), nullable=False, index=True)
    quote_number = Column(String, nullable=True)
    product_group = Column(String, nullable=False)
    quoted_mrr = Column(Float, nullable=False)
    quoted_tcv = Column(Float, nullable=True)
    term_months = Column(Integer, nullable=True)
    quote_date = Column(Date, nullable=False)
    expiration_date = Column(Date, nullable=True)
    quote_status = Column(String, nullable=False)
    discount_pct = Column(Float, nullable=True)
    list_mrr = Column(Float, nullable=True)
    competitor_quote = Column(Float, nullable=True)

    customer = relationship("Customer", back_populates="quotes")


class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_account = Column(String, ForeignKey("customers.customer_account"), nullable=False, index=True)
    service_id = Column(String, nullable=True)
    product_group = Column(String, nullable=False)
    product_detail = Column(String, nullable=True)
    mrr = Column(Float, nullable=False)
    service_status = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    contract_end_date = Column(Date, nullable=True)
    term_months = Column(Integer, nullable=True)
    auto_renew = Column(Boolean, nullable=True)
    location_a = Column(String, nullable=True)
    location_z = Column(String, nullable=True)
    bandwidth = Column(String, nullable=True)
    last_change_date = Column(Date, nullable=True)
    change_type = Column(String, nullable=True)

    customer = relationship("Customer", back_populates="services")


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_account = Column(String, ForeignKey("customers.customer_account"), nullable=False, index=True)
    location_name = Column(String, nullable=False)
    location_type = Column(String, nullable=False)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    on_net_status = Column(String, nullable=False)
    building_access = Column(String, nullable=True)
    active_services = Column(Integer, nullable=True)
    monthly_revenue = Column(Float, nullable=True)
    fiber_lit = Column(Boolean, nullable=True)
    location_notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="locations")


# Create all tables
def init_db():
    Base.metadata.create_all(bind=engine)
