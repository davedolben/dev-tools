FROM ubuntu:18.04

RUN apt update
RUN apt install -y curl
# Download and follow redirects
RUN cd /tmp && curl -O -L https://golang.org/dl/go1.16.6.linux-amd64.tar.gz
RUN cd /tmp && rm -rf /usr/local/go && tar -C /usr/local -xzf go1.16.6.linux-amd64.tar.gz
RUN echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc

CMD ["bash"]

